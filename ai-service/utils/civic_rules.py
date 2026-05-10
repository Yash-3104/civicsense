CANDIDATE_LABELS = [
    "pothole",
    "water leak",
    "garbage dump",
    "streetlight failure",
    "road damage",
    "construction hazard",
    "traffic obstruction",
    "sewage overflow",
    "blocked drain",

    # non-civic labels
    "animal",
    "food",
    "person portrait",
    "indoor object",
    "toy",
    "nature scene",
    "random object",
    "clean roadway",
    "non-civic scene",
]

MIN_CIVIC_CONFIDENCE = 0.32
HIGH_CONFIDENCE_THRESHOLD = 0.60

CATEGORY_MAPPING = {
    "pothole": "POTHOLE",
    "road damage": "POTHOLE",
    "construction hazard": "POTHOLE",
    "traffic obstruction": "POTHOLE",

    "water leak": "WATER_LEAK",
    "sewage overflow": "WATER_LEAK",
    "blocked drain": "WATER_LEAK",

    "garbage dump": "GARBAGE",

    "streetlight failure": "STREETLIGHT",
}

NON_CIVIC_LABELS = {
    "animal",
    "food",
    "person portrait",
    "indoor object",
    "toy",
    "nature scene",
    "random object",
    "clean roadway",
    "non-civic scene",
}

CIVIC_LABELS = set(CATEGORY_MAPPING.keys())

HIGH_SEVERITY_LABELS = {
    "sewage overflow",
    "traffic obstruction",
    "construction hazard",
}

MEDIUM_SEVERITY_LABELS = {
    "water leak",
    "garbage dump",
    "pothole",
    "road damage",
    "blocked drain",
    "streetlight failure",
}

HIGH_SEVERITY_KEYWORDS = [
    "flood",
    "collapsed",
    "broken",
    "damaged",
    "large",
    "huge",
    "fire",
    "accident",
    "traffic",
    "overflow",
    "sewage",
    "blocked",
]

MEDIUM_SEVERITY_KEYWORDS = [
    "water",
    "garbage",
    "trash",
    "crack",
    "pothole",
    "leak",
    "construction",
    "drain",
    "road",
    "street",
]

NON_CIVIC_HINTS = [
    "white background",
    "studio",
    "animal",
    "food",
    "toy",
    "rock",
    "flower",
    "table",
    "banana",
    "cat",
    "dog",
    "selfie",
    "portrait",
]

TITLE_BY_CATEGORY = {
    "WATER_LEAK": "Water leakage near roadway",
    "GARBAGE": "Garbage accumulation reported",
    "STREETLIGHT": "Streetlight issue detected",
    "POTHOLE": "Road damage / pothole detected",
}