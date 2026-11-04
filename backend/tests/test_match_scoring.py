from app.user.opportunities.match_scoring.service import calculate_match_score


def test_calculate_match_score():
    score = calculate_match_score(
        required_skills=["Python", "FastAPI", "Docker"],
        candidate_skills=["python", " fastapi ", "Git"],
    )

    assert score == 66.67


def test_calculate_match_score_ignores_duplicates():
    score = calculate_match_score(
        required_skills=["Python", "Python", "FastAPI"],
        candidate_skills=["Python", "Python"],
    )

    assert score == 50.0


def test_calculate_match_score_without_required_skills():
    score = calculate_match_score(
        required_skills=[],
        candidate_skills=["Python"],
    )

    assert score == 0.0
