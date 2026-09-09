# Presentation studio

The studio is split into three routed slices:

- `dashboard/` lists saved presentations and creates new subjects;
- `editor/` edits the subject, parts, sequences and private speaker notes;
- `presentation/` provides a dedicated stage with navigation and animated transitions.

The backend persists the document through the Effect v4 `PresentationStore`
service and SQLite.
