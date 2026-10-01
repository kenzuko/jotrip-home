# Food 01 - editorial review state

Status: Claude returned all 294/294 blocks for food-01. Do not publish automatically.

## Locked decisions

- All `goi-ca-trich.*`: KEEP ORIGINAL. User already edited this record manually in CMS.
- `dishes.hu-tieu-muc.taste_texture`: TAKE CLAUDE. It corrects the wrong noun "tô bún" to "tô hủ tiếu".
- `dishes.banh-canh-ghe.allergy_note`: EDIT. Original has duplicate "phần phần"; keep fact, fix wording.
- `dishes.hau-nuong-mo-hanh.allergy_note`: EDIT / FACT REVIEW. Current field is not really an allergy note and duplicates safety advice; do not accept blindly.
- `dishes.ghe-ham-ninh.tips.2`: FACT REVIEW. The anticoagulant advice needs source support before retaining.
- `dishes.goi-ca-trich.taste_texture`: KEEP ORIGINAL. Claude's "bớt mùi" can imply an undesirable fish smell.
- `dishes.banh-canh-ca-thu.taste_texture`: KEEP ORIGINAL. Claude rewrite is less natural.
- `dishes.lau-ca-bop.how_to_eat`: KEEP ORIGINAL. Original rhythm is better.
- `dishes.banh-mi-cha-ca.intro`: EDIT. Avoid intensifying "vui miệng" with "rất".

## Default selection rule for the remaining blocks

1. If Claude is identical: KEEP ORIGINAL.
2. If the only change is adding "hãy", article particles, or punctuation with no gain: KEEP ORIGINAL.
3. If Claude removes repetition or shortens a stiff sentence without losing information: TAKE CLAUDE.
4. If Claude changes nuance, implies a new fact, weakens a safety statement, or makes prose more generic: KEEP ORIGINAL or EDIT.
5. Ask-staff questions already natural: KEEP ORIGINAL unless there is a real grammar/fact correction.
6. No automatic publish. Final candidate must preserve IDs and source facts.

## Style cleanup pass

- Avoid repeated "hãy" across adjacent tips.
- Prefer direct Vietnamese: "Nếu dị ứng..., hỏi..." when natural.
- Keep local/editorial rhythm where it adds texture.
- Do not make food sound promotional.
- Do not replace precise safety wording with softer generic wording.

This file is a review manifest only. It does not modify main or production data.
