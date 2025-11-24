.PHONY: integration deploy secrets

# Integration tests (deploy + test via Hurl)
integration:
	@echo "🚀 Deploying test app to Fly..."
	fly deploy --ha=false
	@echo ""
	@echo "⏳ Waiting 5s for deployment..."
	sleep 5
	@echo ""
	@echo "🧪 Running Hurl integration tests..."
	hurl tests/*.hurl \
		--variable APP_URL=https://ezthrottle-sdk-node.fly.dev \
		--test \
		--color
	@echo ""
	@echo "✅ All tests passed!"

# Deploy to Fly.io
deploy:
	fly deploy --ha=false

# Set secrets (run once after fly launch)
secrets:
	@bash -c 'source .env.test'
