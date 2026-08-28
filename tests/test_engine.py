import unittest
from datetime import datetime
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from engine.shotcode import shot_code_at

class ShotCodeTest(unittest.TestCase):
    def test_formula(self):
        issued = datetime(2026, 8, 28, 14, 3)
        self.assertEqual(shot_code_at(issued, 0), '843')
        self.assertEqual(shot_code_at(issued, 9), '852')
    def test_bounds(self):
        with self.assertRaises(ValueError): shot_code_at(datetime.now(), 10)
if __name__ == '__main__': unittest.main()
