from fastapi import FastAPI
from fastapi.testclient import TestClient
from router import router

# 1. Setup the app and client first
app = FastAPI()
app.include_router(router)
client = TestClient(app)

# 2. Then write the tests
def test_get_all_pitches():
    response = client.get("/pitches")
    
    # Check the results!
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    datalength = len(data)
    assert datalength > 1
    assert data[0]["title"] == "Pitch 1"
    print(f"Number of pitches returned: {datalength}")
def test_create_pitch():
    new_pitch = {
        "title": "New Pitch Title",
        "content": "This is the content of the new pitch, which should be at least 50 characters long.",
        "category": "Technology"
    }
    response = client.post("/pitches", json=new_pitch)
    
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == new_pitch["title"]
    assert data["content"] == new_pitch["content"]
    assert data["category"] == new_pitch["category"]
    assert data["state"] == PitchStatus.DRAFT
    assert data["description"] is None
    print(f"New pitch created: {data['title']}")

