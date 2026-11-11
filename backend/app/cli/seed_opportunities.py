"""Database seeder for sample 42 peer project opportunities and pitches.

Populates realistic 1337 / 42 project pitches (ft_transcendence, ft_irc, minishell)
and corresponding open opportunities so the Discover UI immediately has rich
collaborative data to explore, filter, and apply to.
"""

from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import select

from app.core.auth import hash_password
from app.core.db import SessionLocal
from app.oauth.user import Users
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.pitches.models import Pitch
from app.user.pitches.utils import render_and_sanitize


SAMPLE_PROJECTS = [
    {
        "pitch": {
            "title": "ft_transcendence: Multiplayer Pong Arcade & Social Club",
            "category": "Technology",
            "description": "Full-stack real-time gaming web app with 3D Pong, WebSockets, OAuth2, and tournament matchmaking.",
            "content": """# ft_transcendence — 1337 Common Core Capstone

We are building a responsive multiplayer Pong game platform with live chat, 2FA authentication, and tournament brackets.
Our tech stack includes React, Tailwind CSS, TypeScript, FastAPI backend, and WebSockets.

### What we need
We are forming a team of 4 dedicated students to reach 125% on transcendence. Looking for a frontend specialist and a DevOps engineer to join the founding duo!""",
        },
        "opportunities": [
            {
                "title": "Frontend Lead (React + Three.js + Socket.IO)",
                "description": "Architect the 3D Pong arena with Three.js, implement responsive tournament bracket tree, and build dark-mode UI with Tailwind CSS.",
                "required_skills": ["React", "TypeScript", "Three.js", "Socket.IO", "TailwindCSS"],
            },
            {
                "title": "DevOps & Infrastructure Engineer",
                "description": "Set up multi-container Docker Compose with Nginx reverse proxy, automated SSL certificates, and PostgreSQL disaster recovery backups.",
                "required_skills": ["Docker", "Nginx", "PostgreSQL", "FastAPI", "Linux"],
            },
        ],
    },
    {
        "pitch": {
            "title": "ft_irc: High-Performance RFC 1459/2812 IRC Server",
            "category": "Technology",
            "description": "Non-blocking C++98 Internet Relay Chat server handling concurrent clients with poll()/epoll().",
            "content": """# ft_irc — Systems & Networking Project

Building a robust, fully compliant IRC daemon from scratch in C++98 without any external libraries.
Requires deep understanding of socket programming, multiplexing with select/poll, and channel operator privileges.

### Target Objectives
- Zero memory leaks under Valgrind
- Complete channel modes (+o, +p, +s, +i, +t, +n, +m, +l, +b, +v, +k)
- Seamless compatibility with irssi and HexChat clients.""",
        },
        "opportunities": [
            {
                "title": "Systems Socket & Protocol Developer",
                "description": "Implement non-blocking TCP socket state machine, buffer management, and RFC command parsers (JOIN, PART, PRIVMSG, KICK, MODE).",
                "required_skills": ["C++", "C", "Sockets", "Linux", "Valgrind", "Git"],
            },
        ],
    },
    {
        "pitch": {
            "title": "RoboNexus: Autonomous Navigation with ROS 2 & Gazebo",
            "category": "Technology",
            "description": "Campus mobile robot utilizing LIDAR SLAM, Nav2 path planning, and embedded motor control.",
            "content": """# RoboNexus — Autonomous Campus Delivery Bot

A robotics initiative at 1337 bringing hardware and AI together. We are integrating ROS 2 Humble with a custom differential drive robot and synthetic Gazebo test world.
Looking for algorithmic minds with Python and C++ experience!""",
        },
        "opportunities": [
            {
                "title": "SLAM & Perception Specialist",
                "description": "Tune Cartographer 2D LIDAR mapping, sensor fusion with EKF (Extended Kalman Filter), and obstacle costmaps.",
                "required_skills": ["ROS2", "Python", "C++", "SLAM", "OpenCV"],
            },
            {
                "title": "Embedded Hardware & Firmware Hacker",
                "description": "Write STM32/ESP32 firmware for wheel encoder PID control and publish odometry telemetry over micro-ROS serial bridge.",
                "required_skills": ["C", "C++", "FreeRTOS", "Embedded", "Electronics"],
            },
        ],
    },
]


async def seed() -> None:
    async with SessionLocal() as session:
        # 1. Ensure a default campus founder exists
        res = await session.execute(select(Users).where(Users.login == "demo_founder"))
        founder = res.scalar_one_or_none()
        if founder is None:
            founder = Users(
                id=uuid.uuid4(),
                login="demo_founder",
                email="demo_founder@1337.ma",
                fullname="Youssef Benzakour",
                role="user",
                password_hash=hash_password("DemoPassword123!"),
                is_active=True,
            )
            session.add(founder)
            await session.commit()
            await session.refresh(founder)
            print(f"Created demo founder user: {founder.login} ({founder.id})")
        else:
            print(f"Using existing demo founder: {founder.login}")

        # 2. Iterate and seed sample pitches & opportunities
        total_pitches = 0
        total_opportunities = 0

        for item in SAMPLE_PROJECTS:
            pitch_data = item["pitch"]
            # Check if pitch already exists by title
            p_res = await session.execute(
                select(Pitch).where(Pitch.title == pitch_data["title"])
            )
            pitch = p_res.scalar_one_or_none()

            if pitch is None:
                pitch = Pitch(
                    id=uuid.uuid4(),
                    title=pitch_data["title"],
                    description=pitch_data["description"],
                    content=pitch_data["content"],
                    rendered_content=render_and_sanitize(pitch_data["content"]),
                    category=pitch_data["category"],
                    status="published",
                    author_id=founder.id,
                )
                session.add(pitch)
                await session.commit()
                await session.refresh(pitch)
                total_pitches += 1
                print(f"  + Created Pitch: {pitch.title}")
            else:
                print(f"  = Pitch exists: {pitch.title}")

            # 3. Create opportunities for this pitch
            for opp_data in item["opportunities"]:
                o_res = await session.execute(
                    select(Opportunity).where(
                        (Opportunity.project_id == pitch.id)
                        & (Opportunity.title == opp_data["title"])
                    )
                )
                existing_opp = o_res.scalar_one_or_none()

                if existing_opp is None:
                    opp = Opportunity(
                        id=uuid.uuid4(),
                        project_id=pitch.id,
                        title=opp_data["title"],
                        description=opp_data["description"],
                        required_skills=opp_data["required_skills"],
                        status="open",  # Explicitly 'open' so Discover displays it immediately
                    )
                    session.add(opp)
                    await session.commit()
                    total_opportunities += 1
                    print(f"    * Added Open Opportunity: {opp.title}")
                else:
                    # Make sure existing opportunity is 'open'
                    if existing_opp.status != "open":
                        existing_opp.status = "open"
                        await session.commit()
                    print(f"    = Opportunity exists: {existing_opp.title}")

        print(f"\nSeed complete! Seeded {total_pitches} pitches and {total_opportunities} open opportunities.")


if __name__ == "__main__":
    asyncio.run(seed())
