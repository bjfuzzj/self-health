"""Deterministic read-only summaries. Missing observations never become zero."""
import copy
from datetime import date
import math
import re
from records import KINDS, NUTRIENTS

MODES=('fasting','bedtime','unspecified')

def iso_date(value):
    if not isinstance(value,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value):
        raise ValueError('日期必须为 YYYY-MM-DD')
    try: date.fromisoformat(value)
    except ValueError: raise ValueError('日期无效') from None
    return value

def numeric(value):
    return type(value) in (int,float) and math.isfinite(value) and value>=0

def observation_stats(values):
    values=list(values); known=[value for value in values if numeric(value)]
    return {'knownSum':round(sum(known),4) if known else None,'knownCount':len(known),'missingCount':len(values)-len(known),'complete':bool(values) and len(known)==len(values)}

def mode_of(record):
    mode=record.get('measureMode')
    return mode if mode in ('fasting','bedtime') else 'unspecified'

def ordered(records):
    # Stable sort keeps original order when imported observations have no time.
    return sorted(records,key=lambda record:(record.get('date',''),record.get('ts') or ''))

def meal_summary(records):
    entries=[]
    for record in records:
        items=record.get('items')
        if isinstance(items,list) and items:
            entries.extend(item if isinstance(item,dict) else {} for item in items)
        else:
            # Old records may contain only reported totals; count one aggregate entry.
            entries.append(record.get('totals') if isinstance(record.get('totals'),dict) else {})
    return {'count':len(records),'nutritionEntryCount':len(entries),'nutrients':{key:observation_stats(entry.get(key) for entry in entries) for key in NUTRIENTS},'hasEstimates':any(record.get('confidence')=='estimated' for record in records),'estimatedCount':sum(record.get('confidence')=='estimated' for record in records),'unclassifiedConfidenceCount':sum(record.get('confidence') not in ('estimated','measured') for record in records)}

def daily_summary(data,day):
    day=iso_date(day)
    selected={key:ordered(record for record in data.get(key,[]) if record.get('date')==day) for key in KINDS.values()}
    latest={mode:next((copy.deepcopy(record) for record in reversed(selected['bodyMetrics']) if mode_of(record)==mode),None) for mode in MODES}
    activity=selected['dailyActivity'][-1] if selected['dailyActivity'] else {}
    supplements=selected['supplements']; workouts=selected['workouts']
    def activity_value(key):
        value=activity.get(key)
        return value if numeric(value) else None
    return {'date':day,'revision':data.get('meta',{}).get('revision',0),'body':{'latestByMode':latest},'meals':meal_summary(selected['meals']),'supplements':{'count':len(supplements),'nutrients':{key:observation_stats((record.get('nutrients') or {}).get(key) for record in supplements) for key in NUTRIENTS}},'workouts':{'count':len(workouts),'durationMin':observation_stats(record.get('durationMin') for record in workouts),'kcal':observation_stats(record.get('kcal') for record in workouts)},'activity':{'steps':activity_value('steps'),'sleepMin':activity_value('sleepMin')}}

def trend_summary(data,first,last):
    first=iso_date(first); last=iso_date(last)
    if first>last: raise ValueError('from 不能晚于 to')
    selected={key:copy.deepcopy(ordered(record for record in data.get(key,[]) if first<=record.get('date','')<=last)) for key in KINDS.values()}
    dates=sorted({record['date'] for records in selected.values() for record in records})
    body={mode:{metric:[] for metric in ('weightKg','bodyFatPct')} for mode in MODES}
    for record in selected['bodyMetrics']:
        for metric in ('weightKg','bodyFatPct'):
            if numeric(record.get(metric)):
                body[mode_of(record)][metric].append({'date':record['date'],'ts':record.get('ts'),'id':record.get('id'),'value':record[metric]})
    filtered={'meta':data.get('meta',{}),**selected}
    return {'from':first,'to':last,'revision':data.get('meta',{}).get('revision',0),'body':body,'days':[daily_summary(filtered,day) for day in dates],'records':selected}
