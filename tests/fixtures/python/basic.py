import os
from pkg import (
    alpha,
    beta,
)

# module note
VALUE: int = 3
DATA = {"a": 1}

class User(Base):
    @property
    def name(self) -> str:
        return "x"

    async def load(
        self,
        id: int,
    ) -> None:
        pass


def greet(name: str) -> str:
    return name

x = "# not comment"
y = 2  # inline
