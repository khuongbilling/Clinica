#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Clinica: Kingdom of Healing — an RPG-based mobile app that teaches NCLEX-relevant clinical reasoning
  using a Hero-based clinical battle system. Latest feature in test: "Care Attempt" — a universal 1-AP
  fallback action available to every hero that lowers disease corruption by a small amount (5 chapter 1,
  4 chapter 2, 3 chapter 3+, 2 against bosses) without advancing the care chain. Overuse (>2 in a single
  battle) withholds the efficiency star.

frontend:
  - task: "Care Attempt fallback action"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/battle.tsx, /app/frontend/src/game/battle.ts, /app/frontend/app/result.tsx, /app/frontend/src/game/clinical.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            New "Care Attempt" pressable rendered at the bottom of the per-hero actions list with a BASIC tag.
            - 1 AP per use, disabled when AP is insufficient, hero has acted, or outcome is over.
            - Damage scales by chapter and is reduced vs bosses (careAttemptDamage).
            - Increments basicAidUses counter on state and consumes the selected hero's action.
            - basicAidUses is forwarded as `basicAid` query param to /result and parsed there.
            - computeStars in clinical.ts withholds the 3rd star when basicAidUses > 2 (lowBasicAid gate).
            - Result screen shows a warning line "Nx Care Attempt — efficiency star withheld" when > 2 uses.
            Please verify:
              1. Battle screen shows Care Attempt under each hero's action list with a BASIC tag.
              2. Pressing Care Attempt reduces corruption, consumes 1 AP, marks hero as acted.
              3. Star result on /result correctly drops the 3rd star when Care Attempt used 3+ times in a winning run.
              4. No regressions in skill/item/call buttons.

  - task: "Hero-Based Battle System v2 (regression check)"
    implemented: true
    working: true
    file: "/app/frontend/app/battle.tsx, /app/frontend/src/game/battle.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: true
          agent: "main"
          comment: "Previously verified in earlier iteration. Re-test for regression after Care Attempt wiring."

backend:
  - task: "Player CRUD with learning_profile + basicAid-independent fields"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "No backend changes for Care Attempt (purely client-side scoring). Backend unchanged."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 12
  run_ui: true

test_plan:
  current_focus:
    - "Care Attempt fallback action"
    - "Hero-Based Battle System v2 (regression check)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Please focus on the Care Attempt feature end-to-end on the frontend.
        Reproduction path:
          1. Start a battle (any enemy from /(tabs) home Run tab). Skip onboarding if needed.
          2. Inside the battle, select a hero pill -> scroll to Actions tab.
          3. Confirm a "Care Attempt" button appears (BASIC tag, 1 AP).
          4. Tap it: AP should drop by 1, corruption should decrease (text in log), hero should be marked acted.
          5. Repeat across turns until 3+ Care Attempts used + corruption reaches 0 (win).
          6. On /result screen confirm:
             - 3rd "Efficient and safe care" star is NOT awarded.
             - The "CLINICAL FORM" card shows "Nx Care Attempt — efficiency star withheld" line.
        Also verify no regressions on hero skills, items, and consults.
