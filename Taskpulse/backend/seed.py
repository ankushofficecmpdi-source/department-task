"""Reset demo data: cd /app/backend && python seed.py"""

import asyncio

from lib.db import ensure_indexes
from lib.seed_data import seed


async def main() -> None:
    await ensure_indexes()
    await seed(reset=True)
    print("Seeded demo team and tasks.")


if __name__ == "__main__":
    asyncio.run(main())
