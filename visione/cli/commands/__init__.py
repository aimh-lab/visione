from .analyze import AnalyzeCommand
from .compose import ComposeCommand
from .import_ import ImportCommand
from .index import IndexCommand
from .init import InitCommand
from .serve import ServeCommand

available_commands = (
    AnalyzeCommand,
    ComposeCommand,
    ImportCommand,
    IndexCommand,
    InitCommand,
    ServeCommand,
)