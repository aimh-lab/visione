from .import_ import ImportCommand
from .index import IndexCommand
from .init import InitCommand
from .serve import ServeCommand

available_commands = (
    ImportCommand,
    IndexCommand,
    InitCommand,
    ServeCommand,
)