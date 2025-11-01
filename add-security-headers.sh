#!/bin/bash

# Script to add security headers to all HTML files in the Vitrinet project
# This ensures consistent security across the entire frontend codebase

SECURITY_HEADERS='
  <!-- Security Headers -->
  <meta http-equiv="Content-Security-Policy" content="default-src '\''self'\''; script-src '\''self'\'' https://cdn.tailwindcss.com https://cdn.jsdelivr.net '\''unsafe-inline'\''; style-src '\''self'\'' '\''unsafe-inline'\'' https://cdn.tailwindcss.com https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src '\''self'\'' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; img-src '\''self'\'' data: https: blob:; connect-src '\''self'\'' http://localhost:5000 https://api.vitrinet.ir; frame-ancestors '\''none'\''; base-uri '\''self'\''; form-action '\''self'\'';">
  <meta http-equiv="X-Frame-Options" content="DENY">
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta http-equiv="X-XSS-Protection" content="1; mode=block">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Permissions-Policy" content="geolocation=(), microphone=(), camera=(), payment=()">

  <!-- DOMPurify for HTML Sanitization -->
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

  <!-- Security Utils -->
  <script src="/security-utils.js"></script>
'

# List of HTML files to update (excluding already updated ones)
HTML_FILES=(
  "public/admin/admin-login.html"
  "public/admin/dashboard.html"
  "public/admin/reports.html"
  "public/admin/income-stats.html"
  "public/admin/income-insights.html"
  "public/admin/user-messages.html"
  "public/admin/shoping-center.html"
  "public/admin/service-shops.html"
  "public/seller/login.html"
  "public/seller/dashboard.html"
  "public/seller/dashboard-content.html"
  "public/seller/dashboard-logo.html"
  "public/seller/dashboard-products.html"
  "public/seller/dashboard-messages.html"
  "public/seller/dashboard-upgrade.html"
  "public/seller/daily-visits.html"
  "public/seller/performance-status.html"
  "public/service-seller-panel/s-seller-panel.html"
  "public/service-seller-panel/s-profile.html"
  "public/user-panel.html"
  "public/user/dashboard.html"
  "public/categories.html"
  "public/all-products.html"
  "public/all-shops.html"
  "public/all-shopping-centers.html"
  "public/service-directory.html"
  "public/service-shops.html"
  "public/shop.html"
  "public/product.html"
  "public/shops-by-category.html"
  "public/city-explore.html"
  "public/shopping-centers-shops.html"
  "public/post.html"
  "public/contact.html"
  "public/rules.html"
  "public/Ideas.html"
  "public/Ideas2.html"
  "public/hesabketab/accountant.html"
  "public/pad-shops.html"
  "public/verify.html"
  "public/verify-user.html"
  "public/banta-shops.html"
)

echo "🔒 Adding security headers to HTML files..."

for file in "${HTML_FILES[@]}"; do
  if [ -f "$file" ]; then
    # Check if security headers are already present
    if grep -q "X-Frame-Options" "$file"; then
      echo "⏭️  Skipping $file (already has security headers)"
      continue
    fi

    # Create a temp file
    TEMP_FILE=$(mktemp)

    # Process the file
    awk -v headers="$SECURITY_HEADERS" '
      /<title>/ {
        print
        if (!found) {
          print headers
          found=1
        }
        next
      }
      {print}
    ' "$file" > "$TEMP_FILE"

    # Replace original file
    mv "$TEMP_FILE" "$file"
    echo "✅ Updated $file"
  else
    echo "⚠️  File not found: $file"
  fi
done

echo ""
echo "🎉 Security headers added successfully!"
echo "📝 Next steps:"
echo "   1. Review the changes"
echo "   2. Test critical pages (login, register, dashboard)"
echo "   3. Commit and push changes"
