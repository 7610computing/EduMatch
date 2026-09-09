name: Import School Fees

# Manual trigger only - this hits ~2000 external websites, so it
# should be run deliberately, not on every push.
on:
  workflow_dispatch:
    inputs:
      max_schools:
        description: "Max number of schools to process this run"
        required: false
        default: "2162"

jobs:
  import-fees:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Run fee import
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          MAX_SCHOOLS: ${{ github.event.inputs.max_schools }}
        run: node scripts/import-fees.mjs

      # Upload even if the script fails partway through, so you
      # still get whatever review rows were found before the error.
      - name: Upload review CSV
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: fees-review
          path: fees-review.csv
