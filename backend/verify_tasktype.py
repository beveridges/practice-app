"""
Quick script to verify TaskType enum only has Practice
"""
from main import TaskType

print("Current TaskType enum values:")
for task_type in TaskType:
    print(f"  - {task_type.value}")

if len(list(TaskType)) == 1 and TaskType.PRACTICE.value == "Practice":
    print("\n✅ TaskType enum is correct - only Practice is available")
else:
    print("\n❌ TaskType enum is incorrect!")
    print("   Expected: Only 'Practice'")
    print(f"   Found: {[t.value for t in TaskType]}")

