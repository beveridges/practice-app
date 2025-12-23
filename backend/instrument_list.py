"""
Comprehensive list of musical instruments organized by category
Used for dropdown selections in user profile
"""

# Comprehensive instrument list organized by category
INSTRUMENTS_BY_CATEGORY = {
    "Woodwind": [
        "Flute",
        "Piccolo",
        "Clarinet",
        "Bass Clarinet",
        "Oboe",
        "English Horn",
        "Bassoon",
        "Contrabassoon",
        "Saxophone (Alto)",
        "Saxophone (Tenor)",
        "Saxophone (Baritone)",
        "Saxophone (Soprano)",
        "Recorder",
        "Pan Flute",
        "Harmonica",
        "Accordion",
        "Concertina",
        "Bagpipes",
        "Ocarina"
    ],
    "Brass": [
        "Trumpet",
        "Cornet",
        "Flugelhorn",
        "Trombone",
        "Bass Trombone",
        "French Horn",
        "Tuba",
        "Sousaphone",
        "Euphonium",
        "Baritone Horn",
        "Mellophone",
        "Bugle",
        "Alto Horn"
    ],
    "Strings - Bowed": [
        "Violin",
        "Viola",
        "Cello",
        "Double Bass",
        "Viol",
        "Hardingfele",
        "Nyckelharpa"
    ],
    "Strings - Plucked": [
        "Guitar (Acoustic)",
        "Guitar (Electric)",
        "Guitar (Classical)",
        "Bass Guitar",
        "Ukulele",
        "Mandolin",
        "Banjo",
        "Lute",
        "Harp",
        "Harp (Pedal)",
        "Harp (Celtic)",
        "Zither",
        "Sitar",
        "Dulcimer"
    ],
    "Percussion": [
        "Drums (Full Kit)",
        "Snare Drum",
        "Bass Drum",
        "Timpani",
        "Cymbals",
        "Hi-Hat",
        "Drum Machine",
        "Electronic Drums",
        "Bongo",
        "Congas",
        "Djembe",
        "Tabla",
        "Cajon",
        "Tambourine",
        "Maracas",
        "Shakers",
        "Triangle",
        "Xylophone",
        "Marimba",
        "Vibraphone",
        "Glockenspiel",
        "Tubular Bells",
        "Gong",
        "Chimes"
    ],
    "Keyboard": [
        "Piano (Acoustic)",
        "Piano (Digital)",
        "Keyboard",
        "Organ",
        "Synthesizer",
        "Harpsichord",
        "Celesta",
        "Clavichord",
        "Mellotron",
        "Theremin"
    ],
    "Voice": [
        "Soprano",
        "Mezzo-Soprano",
        "Alto (Contralto)",
        "Tenor",
        "Baritone",
        "Bass",
        "Countertenor",
        "Falsetto"
    ],
    "Other": [
        "Conductor",
        "Composer",
        "DJ",
        "Electronic Music Producer",
        "Beatmaker",
        "Other"
    ]
}

# Flattened list of all instruments for easy dropdown population
ALL_INSTRUMENTS = []
for category, instruments in INSTRUMENTS_BY_CATEGORY.items():
    ALL_INSTRUMENTS.extend(instruments)

# Sort alphabetically
ALL_INSTRUMENTS.sort()

def get_instruments_list():
    """
    Return the comprehensive instrument list.
    Returns a list of all instruments sorted alphabetically.
    """
    return ALL_INSTRUMENTS

def get_instruments_by_category():
    """
    Return instruments organized by category.
    Returns a dictionary with category names as keys and lists of instruments as values.
    """
    return INSTRUMENTS_BY_CATEGORY

