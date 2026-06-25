# Legaldirectory Razorpay Cart

## Deploy
1. Upload the complete contents of this folder to the root of the GitHub repository.
2. In Vercel, import/redeploy the repository.
3. Add Production environment variables:
   - RAZORPAY_KEY_ID
   - RAZORPAY_KEY_SECRET
4. Redeploy after saving variables.

## Test
Open `/api/create-order` in a browser. The expected response is `{"error":"Method not allowed"}`.
