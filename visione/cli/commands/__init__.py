from .analyze import AnalyzeCommand
from .build import BuildCommand
from .import_ import ImportCommand
from .index import IndexCommand
from .init import InitCommand
from .serve import ServeCommand

available_commands = (
    AnalyzeCommand,
    BuildCommand,
    ImportCommand,
    IndexCommand,
    InitCommand,
    ServeCommand,
)