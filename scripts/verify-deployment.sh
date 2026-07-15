#!/bin/bash
set +e

# AfyaHero Deployment Verification Script
# Verifies all components are working correctly after deployment

echo "=============================================="
echo "    AFYAHERO DEPLOYMENT VERIFICATION"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARNING=0

echo "📋 Running verification checks..."
echo ""

# 1. Check application is reachable
echo "🔍 1/8: Checking application health endpoint"
if curl -s --head http://localhost:3000/api/health/ready | grep "200 OK" > /dev/null; then
    echo -e "   ${GREEN}✅ Application is responding${NC}"
    ((PASS++))
else
    echo -e "   ${RED}❌ Application not responding${NC}"
    ((FAIL++))
fi

# 2. Check database connection
echo ""
echo "🔍 2/8: Checking database connection"
if psql -d "$SUPABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Database connection working${NC}"
    ((PASS++))
else
    echo -e "   ${RED}❌ Database connection failed${NC}"
    ((FAIL++))
fi

# 3. Check authentication system
echo ""
echo "🔍 3/8: Checking authentication system"
if curl -s "http://localhost:3000/api/auth/csrf" | grep "csrfToken" > /dev/null; then
    echo -e "   ${GREEN}✅ Authentication system active${NC}"
    ((PASS++))
else
    echo -e "   ${YELLOW}⚠️  Authentication check failed (may need configuration)${NC}"
    ((WARNING++))
fi

# 4. Check audit logging
echo ""
echo "🔍 4/8: Checking audit logging"
if psql -d "$SUPABASE_URL" -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log');" | grep "t" > /dev/null; then
    echo -e "   ${GREEN}✅ Audit logging table exists${NC}"
    ((PASS++))
else
    echo -e "   ${RED}❌ Audit logging not configured${NC}"
    ((FAIL++))
fi

# 5. Check Row Level Security
echo ""
echo "🔍 5/8: Checking Row Level Security policies"
RLS_COUNT=$(psql -d "$SUPABASE_URL" -t -c "SELECT count(*) FROM pg_policies WHERE tablename IN ('patients', 'encounters');")
if [ "$RLS_COUNT" -ge 2 ]; then
    echo -e "   ${GREEN}✅ Row Level Security policies active${NC}"
    ((PASS++))
else
    echo -e "   ${RED}❌ RLS policies missing${NC}"
    ((FAIL++))
fi

# 6. Check SSL certificate
echo ""
echo "🔍 6/8: Checking SSL certificate"
if curl -s "https://$(hostname)" --connect-timeout 5 > /dev/null; then
    echo -e "   ${GREEN}✅ SSL certificate valid${NC}"
    ((PASS++))
else
    echo -e "   ${YELLOW}⚠️  SSL certificate not configured (required for production)${NC}"
    ((WARNING++))
fi

# 7. Check backup configuration
echo ""
echo "🔍 7/8: Checking backup configuration"
if gcloud sql backups list --instance=afyahero-db --limit 1 2>/dev/null | grep -i "successful" > /dev/null; then
    echo -e "   ${GREEN}✅ Automated backups configured${NC}"
    ((PASS++))
else
    echo -e "   ${YELLOW}⚠️  Backup status unknown${NC}"
    ((WARNING++))
fi

# 8. Check monitoring alerts
echo ""
echo "🔍 8/8: Checking monitoring configuration"
if gcloud monitoring alert-policies list --filter="display_name:AfyaHero" 2>/dev/null | grep -i "enabled" > /dev/null; then
    echo -e "   ${GREEN}✅ Monitoring alerts active${NC}"
    ((PASS++))
else
    echo -e "   ${YELLOW}⚠️  Monitoring alerts not configured${NC}"
    ((WARNING++))
fi

echo ""
echo "=============================================="
echo "            VERIFICATION RESULTS"
echo "=============================================="
echo ""
echo -e "   ${GREEN}✅ Passed: $PASS${NC}"
echo -e "   ${YELLOW}⚠️  Warnings: $WARNING${NC}"
echo -e "   ${RED}❌ Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ] && [ $WARNING -eq 0 ]; then
    echo -e "🎉 ${GREEN}ALL CHECKS PASSED! Deployment is ready for production.${NC}"
elif [ $FAIL -eq 0 ]; then
    echo -e "✅ ${YELLOW}Deployment functional with warnings. Review items above.${NC}"
else
    echo -e "❌ ${RED}Deployment has failures. Please fix issues before going live.${NC}"
fi

echo ""
echo "📞 Support: gcp-support@afyahero.co"
echo ""