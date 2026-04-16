from enum import Enum
from typing import Any
from langchain_core.structured_query import FilterDirective
from langchain_postgres.translator import PGVectorTranslator

class ExtendedComparator(str, Enum):
    EQ = "eq"
    NE = "ne"
    GT = "gt"
    GTE = "gte"
    LT = "lt"
    LTE = "lte"
    CONTAIN = "contain"
    LIKE = "like"
    IN = "in"
    NIN = "nin"
    ILIKE = "ilike"

class ExtendedPGVectorTranslator(PGVectorTranslator):
    """Adds support for ilike, gte, lte operator in filters."""
    allowed_comparators = [
        ExtendedComparator.ILIKE,
        ExtendedComparator.EQ,
        ExtendedComparator.NE,
        ExtendedComparator.GT,
        ExtendedComparator.LT,
        ExtendedComparator.IN,
        ExtendedComparator.NIN,
        ExtendedComparator.CONTAIN,
        ExtendedComparator.LIKE,
    ]

    visit_extended_comparison = PGVectorTranslator.visit_comparison

class ExtendedComparison(FilterDirective):
    """Comparison to a value."""

    comparator: ExtendedComparator
    """The comparator to use."""

    attribute: str
    """The attribute to compare."""

    value: Any
    """The value to compare to."""

    def __init__(
        self, comparator: ExtendedComparator, attribute: str, value: Any, **kwargs: Any
    ) -> None:
        """Create a Comparison.

        Args:
            comparator: The comparator to use.
            attribute: The attribute to compare.
            value: The value to compare to.
        """
        # super exists from BaseModel
        super().__init__(
            comparator=comparator, attribute=attribute, value=value, **kwargs
        )