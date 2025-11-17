.PHONY: help build up down logs migrate clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build all Docker containers
	docker-compose build

up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

logs: ## Show logs from all services
	docker-compose logs -f

migrate: ## Run database migrations
	docker-compose exec api npm run db:migrate

seed: ## Seed database with test devices
	docker-compose exec api npm run db:seed

clean: ## Remove all containers and volumes
	docker-compose down -v
	docker-compose rm -f

dev-backend: ## Start backend in development mode
	cd backend && npm install && npm run dev

dev-frontend: ## Start frontend in development mode
	cd frontend && npm install && npm run dev

