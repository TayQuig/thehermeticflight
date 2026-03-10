# ARCHIVED — 2026-03-09
# This Zapier Python script tagged Mailchimp subscribers with archetype tags
# for the 4-week launch sequence. Replaced by Loops.so integration (quiz-submit API).
# Kept for reference only.

import requests
import hashlib
import json

# ─── CONFIGURATION ──────────────────────────────────────────────────
ARCHETYPE_TAGS = [
    "archetype:air_weaver",
    "archetype:embodied_intuitive",
    "archetype:ascending_seeker",
    "archetype:shadow_dancer",
    "archetype:flow_artist",
    "archetype:grounded_mystic"
]

LAUNCH_TAG = "launch_sequence"

# ─── INPUTS FROM ZAPIER ─────────────────────────────────────────────
api_key = input_data.get('api_key', '')
list_id = input_data.get('list_id', '')

if not api_key or not list_id:
    output = {
        'status': 'error',
        'message': 'Missing api_key or list_id in Input Data. Check your Zapier step config.'
    }
else:
    # ─── SETUP API CONNECTION ────────────────────────────────────────
    dc = api_key.split('-')[-1]  # e.g., "us21"
    base_url = f"https://{dc}.api.mailchimp.com/3.0"
    auth = ('anystring', api_key)

    try:
        # ─── STEP 1: Get all tags/segments for this audience ─────────
        segments_url = f"{base_url}/lists/{list_id}/segments"
        all_segments = []
        offset = 0

        while True:
            resp = requests.get(
                segments_url,
                auth=auth,
                params={'count': 100, 'offset': offset, 'type': 'static'}
            )
            resp.raise_for_status()
            data = resp.json()
            all_segments.extend(data.get('segments', []))
            if len(all_segments) >= data.get('total_items', 0):
                break
            offset += 100

        # ─── STEP 2: Match archetype tag names to segment IDs ───────
        archetype_segment_ids = {}
        for seg in all_segments:
            if seg['name'] in ARCHETYPE_TAGS:
                archetype_segment_ids[seg['name']] = seg['id']

        # ─── STEP 3: Collect all unique subscribers from those tags ──
        unique_subscribers = {}

        for tag_name, seg_id in archetype_segment_ids.items():
            members_url = f"{base_url}/lists/{list_id}/segments/{seg_id}/members"
            offset = 0

            while True:
                resp = requests.get(
                    members_url,
                    auth=auth,
                    params={'count': 100, 'offset': offset}
                )
                resp.raise_for_status()
                data = resp.json()

                for member in data.get('members', []):
                    email = member['email_address'].lower()
                    if email not in unique_subscribers:
                        unique_subscribers[email] = {
                            'email': email,
                            'archetype_tags': [tag_name],
                            'status': member.get('status', 'unknown')
                        }
                    else:
                        unique_subscribers[email]['archetype_tags'].append(tag_name)

                if offset + 100 >= data.get('total_items', 0):
                    break
                offset += 100

        # ─── STEP 4: Add launch_sequence tag to each subscriber ─────
        tagged_count = 0
        skipped_count = 0
        errors = []

        for email, info in unique_subscribers.items():
            # Only tag subscribed members (skip unsubscribed/cleaned)
            if info['status'] != 'subscribed':
                skipped_count += 1
                continue

            subscriber_hash = hashlib.md5(email.encode()).hexdigest()
            tag_url = f"{base_url}/lists/{list_id}/members/{subscriber_hash}/tags"

            payload = {
                "tags": [{"name": LAUNCH_TAG, "status": "active"}]
            }

            try:
                resp = requests.post(tag_url, auth=auth, json=payload)
                resp.raise_for_status()
                tagged_count += 1
            except Exception as e:
                errors.append(f"{email}: {str(e)}")

        # ─── OUTPUT SUMMARY ──────────────────────────────────────────
        output = {
            'status': 'complete',
            'total_unique_subscribers': len(unique_subscribers),
            'successfully_tagged': tagged_count,
            'skipped_not_subscribed': skipped_count,
            'error_count': len(errors),
            'errors': json.dumps(errors[:10]) if errors else 'none',
            'archetype_tags_found': ', '.join(archetype_segment_ids.keys()),
            'archetype_tags_missing': ', '.join(
                [t for t in ARCHETYPE_TAGS if t not in archetype_segment_ids]
            ) or 'none — all 6 found',
            'tag_applied': LAUNCH_TAG
        }

    except Exception as e:
        output = {
            'status': 'error',
            'message': f'API error: {str(e)}'
        }
