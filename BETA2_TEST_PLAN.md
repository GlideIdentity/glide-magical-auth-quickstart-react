# Beta.2 Testing Plan

## 🚀 **Ready for Team Testing**

The quickstart is now using the published beta.2 version from npm with cross-device support.

## **Versions**
- **glide-web-client-sdk**: `4.0.0-beta.2` (published to npm)
- **glide-sdk**: `5.0.0-beta.1` (Node SDK)

## **Branch**: `test-beta2-sdk`

## **Key Features to Test**

### 1. **Cross-Device (QR Code) Flow**
- SDK automatically detects QR code after 3 seconds
- Timeout extends from 30s → 120s
- Monitor console for "Cross-device flow detected" message

### 2. **Silent Retries**
- Network failures retry automatically (invisible to user)
- Only shows error after 2 retry attempts fail
- Test by: Brief network interruption during auth

### 3. **Manual Retry**
- Orange "Retry Request" button appears on error
- Click to retry without refreshing page

### 4. **Optional Callbacks**
- Check console for callback messages (if debug enabled)
- `onCrossDeviceDetected` - when QR shown
- `onRetryAttempt` - on silent retries

## **Testing Steps**

### 1. **Start the App**
```bash
git checkout test-beta2-sdk
npm install  # Already done
npm run dev
```

### 2. **Test Normal Flow**
- Enter phone: +16287892016
- Click "Verify Phone Number"
- Should complete in <30 seconds

### 3. **Test QR Code Flow**
- Start verification
- If QR code appears, you have 2 minutes to complete
- Watch for console message after 3 seconds

### 4. **Test Retry Button**
- Trigger an error (cancel, wrong phone, etc.)
- Orange "Retry Request" button should appear
- Click to retry without page refresh

## **What Changed**

### From beta.1 → beta.2:
- ✅ Automatic QR code detection
- ✅ Dynamic timeout extension
- ✅ Silent retry pattern
- ✅ Manual retry capability
- ✅ Optional monitoring callbacks
- ✅ 100% backward compatible

## **Console Messages to Watch**

With debug enabled (`VITE_GLIDE_DEBUG=true`):
```
🔍 Cross-device flow detected (QR code shown)
🔄 Retry attempt 1/2
```

## **Success Criteria**

- [ ] Normal flow works (<30s)
- [ ] QR code flow works (2 minute timeout)
- [ ] Retry button appears on error
- [ ] No error flash on transient failures
- [ ] Console shows debug messages (if enabled)

## **Reporting Issues**

If you find issues:
1. Note the error message and code
2. Check browser console for details
3. Note if it was QR code or normal flow
4. Share the request ID if available

## **Next Steps**

After team testing:
1. Merge to master if all tests pass
2. Publish as v4.1.0 (production release)
3. Update all demand partners

---

**The beta.2 SDK solves the QR code timeout issue!** Test thoroughly and report any issues.
