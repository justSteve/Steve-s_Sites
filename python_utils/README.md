# Python Utilities

This directory contains Python scripts that leverage Python's unique strengths for specialized tasks.

## Purpose

While the main application is TypeScript-based, Python is used for:
- Data analysis and statistical computations
- Specialized text processing
- Machine learning/NLP (if needed in future)
- Quick utilities that benefit from Python's rich ecosystem

## Structure

```
python_utils/
├── analysis/          # Data analysis scripts
├── processing/        # Text/data processing utilities
├── visualization/     # Data visualization (matplotlib, etc.)
└── shared/           # Shared Python utilities
```

## Calling from TypeScript

Use the `PythonBridge` service:

```typescript
import { PythonBridge } from '../services/PythonBridge';

const bridge = new PythonBridge(logger);
const result = await bridge.executeJSON<ResultType>(
  'python_utils/analysis/analyze_snapshots.py',
  { args: ['--domain', 'juststeve.com'] }
);
```

## Development Guidelines

1. **Output JSON for data exchange**
   ```python
   import json
   result = {"key": "value"}
   print(json.dumps(result))
   ```

2. **Use argparse for CLI arguments**
   ```python
   import argparse
   parser = argparse.ArgumentParser()
   parser.add_argument('--domain', required=True)
   args = parser.parse_args()
   ```

3. **Type hints and docstrings**
   ```python
   def process_data(domain: str) -> Dict[str, Any]:
       """Process snapshot data for a domain."""
       pass
   ```

4. **Error handling**
   ```python
   import sys
   try:
       # your code
   except Exception as e:
       print(json.dumps({"error": str(e)}), file=sys.stderr)
       sys.exit(1)
   ```

## Dependencies

Install Python dependencies:
```bash
pip install -r requirements.txt
```
