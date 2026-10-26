from pydantic import BaseModel, Field, model_validator


class UpdateOpportunityRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1)
    required_skills: list[str] | None = None

    @model_validator(mode="after")
    def require_update_field(self) -> "UpdateOpportunityRequest":
        if all(
            value is None
            for value in (self.title, self.description, self.required_skills)
        ):
            raise ValueError("At least one opportunity field must be provided")
        return self