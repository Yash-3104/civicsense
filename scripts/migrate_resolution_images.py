import os
import cloudinary
import cloudinary.uploader
import psycopg2

cloudinary.config(
    cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
    api_key=os.environ["CLOUDINARY_API_KEY"],
    api_secret=os.environ["CLOUDINARY_API_SECRET"],
)

conn = psycopg2.connect(
    host=os.environ["DB_HOST"],
    database=os.environ["DB_NAME"],
    user=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    port=os.environ.get("DB_PORT", "5432"),
)

cur = conn.cursor()

cur.execute("""
SELECT id, resolution_image_url
FROM issues
WHERE resolution_image_url IS NOT NULL
  AND resolution_image_url NOT LIKE 'https://res.cloudinary.com/%'
""")

rows = cur.fetchall()

success = 0
failed = 0

try:

    for issue_id, resolution_url in rows:

        filename = resolution_url.replace(
            "http://localhost:8031/uploads/",
            ""
        )

        filepath = os.path.join(
            "uploads",
            filename
        )

        if not os.path.exists(filepath):
            print(f"MISSING: {filename}")
            failed += 1
            continue

        try:

            result = cloudinary.uploader.upload(
                filepath,
                folder="civicsense-dev/resolution-evidence"
            )

            secure_url = result["secure_url"]

            cur.execute("""
            UPDATE issues
            SET resolution_image_url = %s
            WHERE id = %s
            """, (secure_url, issue_id))

            print(f"SUCCESS: {filename}")
            success += 1

        except Exception as ex:

            print(f"FAILED: {filename}")
            print(ex)
            failed += 1

    conn.commit()

except Exception as ex:

    conn.rollback()
    print("Migration aborted.")
    print(ex)
    raise

finally:

    cur.close()
    conn.close()

print()
print(f"Success={success}")
print(f"Failed={failed}")
