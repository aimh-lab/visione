from .add import AddCommand
from .analyze import AnalyzeCommand
from .compose import ComposeCommand
from .import_ import ImportCommand
from .index import IndexCommand
from .init import InitCommand
from .remove import RemoveCommand
from .serve import ServeCommand

available_commands = (
    AddCommand,
    AnalyzeCommand,
    ComposeCommand,
    ImportCommand,
    IndexCommand,
    InitCommand,
    RemoveCommand,
    ServeCommand,
)