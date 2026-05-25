V10 update: Sortable lead table headers

What changed:
- The main lead table headers are now clickable.
- Score, Status, Category, Lead Name, Property Address, County, City, Zip, Owner, Builder / Contractor, and Phone can be sorted.
- Clicking a header once sorts one direction; clicking it again reverses the order.
- The active sort column is highlighted and shows an arrow.
- Sorting is done through Supabase, so the full matching lead list is sorted, not only the rows visible on the current page.

GitHub commit summary:
Add sortable lead table headers
