#!/usr/bin/env python3
"""Validate conference catalogue structure and the verified older appearances."""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "conferences" / "data.json"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
REQUIRED_FIELDS = {
    "date",
    "title",
    "conference",
    "conferenceUrl",
    "presenters",
    "youtubeUrl",
    "presentationUrl",
    "agendaDocUrl",
    "presentationDocUrl",
}
URL_FIELDS = (
    "conferenceUrl",
    "youtubeUrl",
    "recordingUrl",
    "presentationUrl",
    "agendaDocUrl",
    "presentationDocUrl",
)

OLDER_APPEARANCES = [
    {
        "date": "2019-11-11",
        "dateDisplay": "2019-11-11–15 (exact day not stated)",
        "title": "Other Protocols",
        "conference": "W3C Distributed Tracing Working Group Workshop, Seattle",
        "role": "Presenter: Sergey Kanzhelev (Microsoft)",
        "presenters": ["Sergey Kanzhelev"],
        "conferenceUrl": "https://www.w3.org/blog/2019/w3c-distributed-tracing-working-group-workshop-in-seattle-november-2019/",
        "youtubeUrl": "",
        "recordingUrl": "",
    },
    {
        "date": "2019-11-20",
        "title": "Beyond Getting Started: Using OpenTelemetry to Its Full Potential",
        "conference": "KubeCon + CloudNativeCon North America 2019",
        "role": "Co-speakers: Sergey Kanzhelev; Morgan McLean",
        "presenters": ["Sergey Kanzhelev", "Morgan McLean"],
        "conferenceUrl": "https://kccncna19.sched.com/event/UaWN/beyond-getting-started-using-opentelemetry-to-its-full-potential-sergey-kanzhelev-microsoft-morgan-mclean-google",
        "youtubeUrl": "https://www.youtube.com/watch?v=FlghuHDlQdM",
        "recordingUrl": "",
    },
    {
        "date": "2019-11-21",
        "title": "OpenTelemetry: The First Release, What’s Next, and How to Get Involved",
        "conference": "KubeCon + CloudNativeCon North America 2019",
        "role": "Maintainer-track co-speaker: Sergey Kanzhelev, with Morgan McLean, Tristan Sloughter, Chris Kleinknecht",
        "presenters": ["Morgan McLean", "Tristan Sloughter", "Sergey Kanzhelev", "Chris Kleinknecht"],
        "conferenceUrl": "https://kccncna19.sched.com/event/Uake/opentelemetry-the-first-release-whats-next-and-how-to-get-involved-morgan-mclean-google-tristan-sloughter-postmates-sergey-kanzhelev-microsoft-chris-kleinknecht-google",
        "youtubeUrl": "https://www.youtube.com/watch?v=CoLaCKQUkKw",
        "recordingUrl": "",
    },
    {
        "date": "2020-05-27",
        "dateDisplay": "2020-05-27 (recording/livestream publication date)",
        "title": "An Introduction to OpenTelemetry by its Co-Creator Sergey Kanzhelev",
        "conference": "The DevOps Insights Show",
        "role": "Featured presenter/interview guest: Sergey Kanzhelev",
        "presenters": ["Sergey Kanzhelev"],
        "conferenceUrl": "https://www.pscp.tv/DevOpsInShow/1djGXQrAAmoJZ",
        "youtubeUrl": "https://www.youtube.com/watch?v=SetBAyAjln4",
        "recordingUrl": "",
    },
    {
        "date": "2020-07-31",
        "title": "Intro: OpenTelemetry SDK Design and Implementation Values",
        "conference": "Cloud Native + Open Source Virtual Summit China 2020",
        "role": "Solo speaker: Sergey Kanzhelev (Google)",
        "presenters": ["Sergey Kanzhelev"],
        "conferenceUrl": "https://cnosvschina20eng.sched.com/event/cpAP/intro-opentelemetry-sdk-design-and-implementation-values-sergey-kanzhelev-google",
        "youtubeUrl": "https://www.youtube.com/watch?v=VJEaqQVyqTA",
        "recordingUrl": "",
    },
    {
        "date": "2020-10-13",
        "title": "OpenTelemetry and Kubernetes",
        "conference": "CMG “Guide to Distributed Tracing” virtual summit",
        "role": "Co-speakers: David Ashpole; Sergey Kanzhelev (Google)",
        "presenters": ["David Ashpole", "Sergey Kanzhelev"],
        "conferenceUrl": "https://www.cmg.org/2020/09/distributedtracing/",
        "youtubeUrl": "",
        "recordingUrl": "https://www.cmg.org/2020/09/opentelemetry-and-kubernetes/",
    },
    {
        "date": "2021-05-05",
        "title": "Kubernetes SIG Node Intro and Deep Dive",
        "conference": "KubeCon + CloudNativeCon Europe 2021 Virtual",
        "role": "Co-speakers: Elana Hashman; Sergey Kanzhelev",
        "presenters": ["Elana Hashman", "Sergey Kanzhelev"],
        "conferenceUrl": "https://kccnceu2021.sched.com/event/iE8E/kubernetes-sig-node-intro-and-deep-dive-elana-hashman-red-hat-sergey-kanzhelev-google",
        "youtubeUrl": "https://www.youtube.com/watch?v=z5aY4e2RENA",
        "recordingUrl": "",
    },
    {
        "date": "2021-10-15",
        "title": "Kubenetes [sic] SIG Node Intro and Deep Dive",
        "conference": "KubeCon + CloudNativeCon North America 2021",
        "role": "Co-speakers: Elana Hashman, Derek Carr, Sergey Kanzhelev, Dawn Chen",
        "presenters": ["Elana Hashman", "Derek Carr", "Sergey Kanzhelev", "Dawn Chen"],
        "conferenceUrl": "https://kccncna2021.sched.com/event/lV9D/kubenetes-sig-node-intro-and-deep-dive-elana-hashman-derek-carr-red-hat-sergey-kanzhelev-dawn-chen-google",
        "youtubeUrl": "https://www.youtube.com/watch?v=v-JAdcSY_3A",
        "recordingUrl": "",
    },
]


def is_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def main() -> int:
    errors: list[str] = []
    try:
        talks = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot load {DATA_PATH.relative_to(ROOT)}: {exc}")
        return 1

    if not isinstance(talks, list):
        print("ERROR: conferences/data.json must contain a JSON array")
        return 1

    identities: set[tuple[str, str]] = set()
    for index, talk in enumerate(talks):
        label = f"entry {index + 1}"
        if not isinstance(talk, dict):
            errors.append(f"{label} must be an object")
            continue
        missing = sorted(REQUIRED_FIELDS - talk.keys())
        if missing:
            errors.append(f"{label} is missing fields: {', '.join(missing)}")
        if not DATE_RE.fullmatch(talk.get("date", "")):
            errors.append(f"{label} has invalid ISO date: {talk.get('date')!r}")
        identity = (talk.get("date", ""), talk.get("title", ""))
        if identity in identities:
            errors.append(f"duplicate talk identity: {identity[0]} — {identity[1]}")
        identities.add(identity)
        presenters = talk.get("presenters")
        if not isinstance(presenters, list) or not presenters or not all(isinstance(name, str) and name for name in presenters):
            errors.append(f"{label} presenters must be a non-empty list of names")
        for field in URL_FIELDS:
            value = talk.get(field, "")
            if not isinstance(value, str) or (value and not is_http_url(value)):
                errors.append(f"{label} has invalid {field}: {value!r}")

    by_identity = {(talk.get("date"), talk.get("title")): talk for talk in talks if isinstance(talk, dict)}
    older_talks = [talk for talk in talks if isinstance(talk, dict) and talk.get("date", "") < "2022-01-01"]
    if len(older_talks) != len(OLDER_APPEARANCES):
        errors.append(
            f"expected exactly {len(OLDER_APPEARANCES)} pre-2022 appearances, found {len(older_talks)}"
        )
    for expected in OLDER_APPEARANCES:
        identity = (expected["date"], expected["title"])
        actual = by_identity.get(identity)
        if actual is None:
            errors.append(f"missing verified older appearance: {identity[0]} — {identity[1]}")
            continue
        for field, value in expected.items():
            if actual.get(field, "") != value:
                errors.append(
                    f"{identity[0]} — {identity[1]}: {field} should be {value!r}, got {actual.get(field, '')!r}"
                )

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print(f"Conference checks passed for {len(talks)} entries, including 8 verified older appearances.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
