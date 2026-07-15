# AfyaHero Code Review Checklist

This checklist ensures consistent code quality and adherence to best practices during code reviews.

## Before Review

- [ ] **Context**: Review the pull request description and understand the purpose of the changes
- [ ] **Scope**: Verify the changes match the described scope
- [ ] **Linked Issues**: Confirm related issues are linked in the PR
- [ ] **Tests**: Check if tests are included or updated for the changes

## Code Quality

- [ ] **TypeScript**: No TypeScript errors (run `npm run typecheck`)
- [ ] **ESLint**: No ESLint warnings or errors (run `npm run lint`)
- [ ] **Formatting**: Code is formatted with Prettier (run `npm run format:check`)
- [ ] **Console Logs**: No `console.log` statements in production code (use logger instead)
- [ ] **Const vs Let**: Used `const` where variables are not reassigned
- [ ] **Imports**: Imports are at the top of the file and organized
- [ ] **Naming**: Variables and functions have descriptive, meaningful names
- [ ] **Comments**: Code is self-documenting; comments only explain "why" not "what"

## Functionality

- [ ] **Requirements**: Implementation matches the requirements/spec
- [ ] **Edge Cases**: Edge cases and error conditions are handled
- [ ] **Validation**: Input validation is present where needed
- [ ] **Error Handling**: Errors are caught and handled gracefully
- [ ] **Logging**: Appropriate logging for debugging and monitoring
- [ ] **Security**: Security best practices are followed (no hardcoded secrets, proper auth)

## Architecture & Design

- [ ] **Separation of Concerns**: Logic is properly separated (UI vs business logic vs data access)
- [ ] **DRY**: No code duplication; common logic is extracted
- [ ] **SOLID**: Follows SOLID principles where applicable
- [ ] **Component Structure**: Components are focused and reusable
- [ ] **State Management**: State is managed appropriately (useState, Zustand, context)
- [ ] **API Calls**: API calls are in appropriate locations (API routes, server actions)

## Performance

- [ ] **Unnecessary Re-renders**: React components don't re-render unnecessarily
- [ ] **Memoization**: useMemo/useCallback used where beneficial
- [ ] **Bundle Size**: No unnecessary large dependencies added
- [ ] **Image Optimization**: Images are optimized (Next.js Image component)
- [ ] **Lazy Loading**: Large components or routes are lazy loaded where appropriate

## Accessibility

- [ ] **Semantic HTML**: Uses semantic HTML elements (nav, main, section, etc.)
- [ ] **ARIA Labels**: ARIA labels for interactive elements without text
- [ ] **Keyboard Navigation**: All functionality is accessible via keyboard
- [ ] **Focus Management**: Focus is managed properly (modals, form errors)
- [ **Color Contrast**: Text has sufficient color contrast (WCAG AA)
- [ ] **Screen Reader**: Screen reader compatible (tested with NVDA/VoiceOver)

## Testing

- [ ] **Unit Tests**: Unit tests added for new functions/components
- [ ] **Integration Tests**: API routes have integration tests
- [ ] **E2E Tests**: Critical user flows have E2E tests (Playwright)
- [ ] **Test Coverage**: New code has adequate test coverage
- [ ] **Test Quality**: Tests are meaningful and not just checking implementation

## Security

- [ ] **Authentication**: Authentication is properly implemented
- [ ] **Authorization**: Authorization checks are in place (role-based access)
- [ ] **Input Sanitization**: User input is sanitized before use
- [ ] **SQL Injection**: Uses parameterized queries (Prisma)
- [ ] **XSS Prevention**: XSS vulnerabilities are prevented (sanitization, CSP)
- [ ] **Secrets**: No secrets hardcoded; use environment variables

## Database

- [ ] **Schema**: Prisma schema changes are documented
- [ ] **Migrations**: Migration files are included and reviewed
- [ ] **Queries**: Database queries are efficient (no N+1 queries)
- [ ] **Indexes**: Appropriate indexes are added for performance
- [ ] **Multi-tenancy**: hospitalId is included in queries where applicable

## AI Integration (if applicable)

- [ ] **Provider Fallback**: AI provider cascade is implemented correctly
- [ ] **Error Handling**: AI failures are handled gracefully with fallbacks
- [ ] **Content Validation**: AI-generated content is validated/sanitized
- [ ] **Rate Limiting**: API rate limiting is in place
- [ ] **Timeout**: Appropriate timeouts are set for AI calls

## Documentation

- [ ] **Comments**: Complex logic has inline comments
- [ ] **README**: README is updated if new features are added
- [ ] **API Docs**: API routes have documentation (OpenAPI if applicable)
- [ ] **Changelog**: Changes are documented in CHANGELOG.md
- [ ] **Migration Guide**: Breaking changes have migration guides

## Specific to AfyaHero

- [ ] **Portal-Specific**: Code follows portal-specific patterns (medical, pharmacy, lab, reception, admin, superadmin)
- [ ] **Settings**: Settings changes use the centralized settings store
- [ ] **Multi-tenant**: Hospital isolation is respected in all queries
- [ ] **Audit Logs**: Sensitive operations create audit log entries
- [ ] **Compliance**: Changes comply with GDPR/SHIF requirements

## Approval Criteria

- [ ] All critical items must be checked
- [ ] No blocking issues found
- [ ] Reviewer understands the changes
- [ ] Reviewer has tested the changes locally if applicable
- [ ] Reviewer is confident the code is production-ready

## Common Issues to Watch For

- **Hardcoded values**: Environment variables should be used for configuration
- **Missing error handling**: Try-catch blocks should handle errors appropriately
- **Inconsistent naming**: Use consistent naming conventions across the codebase
- **Large files**: Consider splitting files that are too large (>500 lines)
- **Deep nesting**: Avoid deeply nested code (more than 4 levels)
- **Magic numbers**: Use named constants instead of magic numbers
- **Unused code**: Remove unused imports, variables, and functions
- **TODO comments**: Resolve TODO comments before merging or create issues

## Review Process

1. **Self-Review**: Author should review their own code against this checklist
2. **Automated Checks**: CI/CD pipeline runs automated checks (lint, typecheck, tests)
3. **Peer Review**: Reviewer goes through this checklist systematically
4. **Approval**: Reviewer approves if all critical items pass
5. **Merge**: Code is merged after approval

## Resources

- [AfyaHero AGENTS.md](../AGENTS.md) - Project-specific guidelines
- [Improvement Implementation Plan](./IMPROVEMENT-IMPLEMENTATION-PLAN.md) - Current improvement roadmap
- [Database Migration Guide](./DATABASE-MIGRATION-GUIDE.md) - Database procedures
