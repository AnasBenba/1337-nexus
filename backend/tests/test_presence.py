from app.user.friends import presence


def test_online_until_last_tab_closes() -> None:
    user = 987654
    assert not presence.is_online(user)

    assert presence.connect(user, "tab-1") is True  # came online
    assert presence.connect(user, "tab-2") is False  # already online
    assert presence.is_online(user)

    assert presence.disconnect(user, "tab-1") is False  # still has tab-2
    assert presence.is_online(user)
    assert presence.disconnect(user, "tab-2") is True  # went offline
    assert not presence.is_online(user)


def test_unknown_disconnect_is_ignored() -> None:
    assert presence.disconnect(123456, "never-connected") is False
