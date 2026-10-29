import copy
import unittest
from tools.prepare_migration import prepare


class HistoricalMigration(unittest.TestCase):
    def test_preserves_history_and_explains_unavailable_photos(self):
        source = {'schemaVersion': 1, 'meta': {'revision': 74}, 'profile': {}, 'sources': {},
                  'bodyMetrics': [], 'dailyActivity': [{'date': '2026-10-28', 'steps': 42}],
                  'meals': [{'id': 'meal-original', 'date': '2026-10-28', 'photo': '用户对话中的图片', 'future': {'keep': True}}],
                  'workouts': [], 'supplements': [], 'journal': [], 'imports': []}
        before = copy.deepcopy(source)
        actual, report = prepare(source)
        self.assertEqual(source, before)
        self.assertEqual(actual['meals'][0]['id'], 'meal-original')
        self.assertEqual(actual['meals'][0]['future'], {'keep': True})
        self.assertEqual(actual['meals'][0]['legacyPhotoReference'], '用户对话中的图片')
        self.assertIsNone(actual['meals'][0]['photo'])
        self.assertEqual(actual['meals'][0]['attachmentStatus'], 'unavailable')
        self.assertTrue(actual['dailyActivity'][0]['id'])
        self.assertEqual(prepare(source)[0], actual)
        self.assertEqual(report['assignedIds'], 1)
        self.assertEqual(report['unavailablePhotos'], 1)


if __name__ == '__main__':
    unittest.main()
