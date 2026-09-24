from .schemas import PitchCreate, PitchResponse

def create_pitch(pitch: PitchCreate):
    return PitchResponse(
        id = 1,
        title = pitch.title,
        content = pitch.content,
        category = pitch.category,
        state = "pending",
        author_id = 123
    )
    # just a placeholder ta ndir meaha database

def get_all_pitches(search: str = None, limit: int = 20):
    # just a placeholder ta ndir meaha database
    pitches = [
        PitchResponse(
            id = 1,
            title = "Pitch 1",
            content = "This is the content of pitch 1",
            category = "Technology",
            state = "pending",
            author_id = 123
        ),
        PitchResponse(
            id = 2,
            title = "Pitch 2",
            content = "This is the content of pitch 2",
            category = "Health",
            state = "approved",
            author_id = 456
        )
    ]
    if search:
        pitches = [pitch for pitch in pitches if search.lower() in pitch.title.lower()]
    return pitches[:limit]

def delete_pitch(pitch_id: int):
    # just a placeholder ta ndir meaha database
    # still need to implement the actual deletion logic
    return {"message": f"Pitch with id {pitch_id} deleted successfully"}

def update_pitch(pitch_id: int, pitch: PitchCreate):
    return PitchResponse(
        id = pitch_id,
        title = pitch.title,
        content = pitch.content,
        category = pitch.category,
        state = "pending",
        author_id = 123
    )
    