#!/usr/bin/env python3
"""Pull Chicago crashes, cluster near intersections, write intersections.json."""

import json
import math
import urllib.parse
import urllib.request
from collections import defaultdict

API = "https://data.cityofchicago.org/resource/85ca-t3if.json"
GRID = 0.0007

WEIGHTS = {
    "fatal": 20.0,
    "a": 8.0,
    "b": 3.0,
    "c": 1.0,
    "pdo": 0.1,
}
