CANDIDATE_LABELS = [
    # civic labels
    "pothole",
    "road damage",
    "water leak",
    "sewage overflow",
    "blocked drain",
    "garbage dump",
    "streetlight failure",
    "construction hazard",
    "traffic obstruction",

    # explicit non-civic / negative labels
    "single rock on plain background",
    "stone object",
    "random object",
    "indoor object",
    "food",
    "animal",
    "person portrait",
    "toy",
    "nature scene",
    "clean roadway",
    "non-civic scene",
]

MIN_CIVIC_CONFIDENCE = 0.34
HIGH_CONFIDENCE_THRESHOLD = 0.60

# If a civic label barely beats a non-civic label, reject it.
MIN_CIVIC_MARGIN_OVER_NON_CIVIC = 0.08

# Water/flood labels often beat pothole when a pothole contains water.
# If pothole/road-damage is close enough and there is no pipe/drain/sewage cue,
# prefer POTHOLE over WATER_LEAK.
POTHOLE_WATER_OVERRIDE_MARGIN = 0.22
POTHOLE_WATER_OVERRIDE_MIN_SCORE = 0.24

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
    "single rock on plain background",
    "stone object",
    "random object",
    "indoor object",
    "food",
    "animal",
    "person portrait",
    "toy",
    "nature scene",
    "clean roadway",
    "non-civic scene",
}

CIVIC_LABELS = set(CATEGORY_MAPPING.keys())

WATER_LABELS = {
    "water leak",
    "sewage overflow",
    "blocked drain",
}

POTHOLE_LABELS = {
    "pothole",
    "road damage",
}

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
    "flooded",
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
    "plain background",
    "studio",
    "animal",
    "food",
    "toy",
    "rock",
    "stone",
    "flower",
    "table",
    "banana",
    "cat",
    "dog",
    "selfie",
    "portrait",
]

WATER_INFRA_HINTS = [
    "pipe",
    "pipeline",
    "hose",
    "drain",
    "sewage",
    "sewer",
    "manhole",
    "leak",
    "leaking",
    "gushing",
    "burst",
]

ROAD_CONTEXT_HINTS = [
    "road",
    "street",
    "roadway",
    "lane",
    "asphalt",
    "pavement",
]

TITLE_BY_CATEGORY = {
    "WATER_LEAK": "Water leakage near roadway",
    "GARBAGE": "Garbage accumulation reported",
    "STREETLIGHT": "Streetlight issue detected",
    "POTHOLE": "Road damage / pothole detected",
}
