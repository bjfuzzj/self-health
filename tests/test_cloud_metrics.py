import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

ROOT=Path(__file__).resolve().parents[1]

def fixture():
    data=json.loads((ROOT/'templates/empty-data.json').read_text())
    data['bodyMetrics']=[{'id':'b','date':'2026-10-29','ts':'2026-10-29T22:00:00+08:00','measureMode':'bedtime','weightKg':75,'bodyFatPct':20},{'id':'f','date':'2026-10-28','measureMode':'fasting','weightKg':74},{'id':'u','date':'2026-10-29','weightKg':73}]
    data['meals']=[{'id':'meal','date':'2026-10-29','confidence':'estimated','items':[{'name':'rice','kcal':0,'proteinG':2},{'name':'soup','proteinG':None}]}]
    data['workouts']=[{'id':'w','date':'2026-10-29','durationMin':0},{'id':'unknown','date':'2026-10-29'}]
    data['dailyActivity']=[{'id':'a','date':'2026-10-29','steps':0}]
    return data

class MetricsPure(unittest.TestCase):
    def test_summary_missing_zero_modes_and_no_mutation(self):
        from cloud.metrics import daily_summary
        data=fixture(); original=copy.deepcopy(data)
        result=daily_summary(data,'2026-10-29')
        self.assertEqual(data,original)
        self.assertIsNone(result['body']['latestByMode']['fasting'])
        self.assertEqual(result['body']['latestByMode']['bedtime']['weightKg'],75)
        self.assertEqual(result['body']['latestByMode']['unspecified']['id'],'u')
        self.assertEqual(result['activity']['steps'],0); self.assertIsNone(result['activity']['sleepMin'])
        calories=result['meals']['nutrients']['kcal']
        self.assertEqual(calories,{'knownSum':0,'knownCount':1,'missingCount':1,'complete':False})
        self.assertIsNone(result['meals']['nutrients']['fatG']['knownSum'])
        self.assertEqual(result['meals']['estimatedCount'],1)
        self.assertEqual(result['workouts']['durationMin']['knownSum'],0)
        self.assertEqual(result['workouts']['durationMin']['missingCount'],1)
        empty=daily_summary(data,'2026-10-27'); self.assertIsNone(empty['activity']['steps'])
        self.assertIsNone(empty['meals']['nutrients']['kcal']['knownSum'])
    def test_trends_only_actual_dates_and_values(self):
        from cloud.metrics import trend_summary
        result=trend_summary(fixture(),'2026-10-27','2026-10-30')
        self.assertEqual([d['date'] for d in result['days']],['2026-10-28','2026-10-29'])
        self.assertEqual(result['body']['fasting']['weightKg'][0]['value'],74)
        self.assertEqual(len(result['body']['fasting']['weightKg']),1)
        self.assertEqual(result['body']['fasting']['bodyFatPct'],[])
        self.assertEqual(result['body']['bedtime']['weightKg'][0]['date'],'2026-10-29')
        self.assertEqual(result['body']['unspecified']['weightKg'][0]['value'],73)
        self.assertEqual(len(result['records']['bodyMetrics']),3)
        self.assertEqual(trend_summary(fixture(),'2026-10-01','2026-10-02')['days'],[])
    def test_strict_dates_and_reversed_ranges(self):
        from cloud.metrics import daily_summary,trend_summary
        for value in (None,'','2026-02-30','20261029','2026-1-1','2026-10-29T00:00:00',29):
            with self.assertRaises(ValueError): daily_summary(fixture(),value)
        with self.assertRaises(ValueError): trend_summary(fixture(),'2026-10-30','2026-10-29')

class MetricsEndpoints(unittest.TestCase):
    def test_authenticated_read_only_summary_and_trends(self):
        from cloud import create_app
        with tempfile.TemporaryDirectory() as tmp:
            app=create_app({'TESTING':True,'SECRET_KEY':'metrics-test','SQLITE_PATH':tmp+'/db','ATTACHMENT_DIR':tmp+'/attachments'})
            repo=app.extensions['health_repository']; repo.initialize('owner','metrics-test-password')
            repo.snapshot({'data':fixture(),'expectedRevision':0,'requestId':'fixture'})
            client=app.test_client(); headers={'Authorization':'Bearer '+repo.issue_token()}
            self.assertEqual(client.get('/api/v1/summary?date=2026-10-29').status_code,401)
            self.assertEqual(client.get('/api/v1/trends?from=2026-10-28&to=2026-10-29').status_code,401)
            before=repo.read()
            summary=client.get('/api/v1/summary?date=2026-10-29',headers=headers)
            self.assertEqual(summary.status_code,200); self.assertEqual(summary.json['revision'],1)
            self.assertEqual(summary.headers['Cache-Control'],'no-store')
            trends=client.get('/api/v1/trends?from=2026-10-28&to=2026-10-29',headers=headers)
            self.assertEqual(trends.status_code,200); self.assertEqual(trends.json['revision'],1)
            for path in ('/summary','/summary?date=bad','/trends','/trends?from=2026-10-29&to=2026-10-28'):
                self.assertEqual(client.get('/api/v1'+path,headers=headers).status_code,400)
            self.assertEqual(repo.read(),before)

class MySQLIsolation(unittest.TestCase):
    def test_each_connection_sets_session_repeatable_read(self):
        from cloud.db import Database
        connection=Mock(); fake_module=Mock(); fake_module.connect.return_value=connection
        config={'DB_HOST':'test','DB_PORT':3306,'DB_USER':'user','DB_PASSWORD':'not-real','DB_NAME':'test_smoke'}
        with patch.dict('sys.modules',{'pymysql':fake_module}):
            result=Database(config).connect()
        self.assertIs(result,connection)
        connection.cursor.return_value.execute.assert_called_once_with('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ')
        connection.commit.assert_called_once()
