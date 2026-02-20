## Phase 1: Foundation & Database Setup
**Goal:** Connect the app to a real database and set up authentication.

**Tasks:**
- Set up the Supabase project (you'll need to provide the keys)
- Create the database schema for contacts and transactions
- Configure Supabase Auth so users can log in


## Phase 2: The Contact List (The "Rolodex")
**Goal:** Manage the people you lend to or borrow from.

**Tasks:**
- Create the "Add Contact" form (Name, Phone, Type)
- Build the main "Contacts" list view with search
- Implement Edit/Delete functionality for contacts


## Phase 3: The Ledger (Transaction Management)
**Goal:** Record money given (Credit) or received (Payment).

**Tasks:**
- Create the individual Contact Details page
- Build the "Add Transaction" interface (Credit vs Payment)
- Display the transaction history list for each contact
- Implement logic to calculate the running balance


## Phase 4: The Dashboard (Big Picture)
**Goal:** Provide a snapshot of financial health.

**Tasks:**
- Calculate total receivables (money others owe you)
- Calculate total payables (money you owe)
- Create a clean summary dashboard view


## Phase 5: Polish & PWA
**Goal:** Make the app feel like a premium native experience.

**Tasks:**
- Improve mobile responsiveness
- Add loading skeletons and smooth transitions
- Configure PWA (Progressive Web App) manifest for installability
