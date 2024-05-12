start:
	docker compose up -t 1 -d --build
	make logs

stop:
	docker compose down -t 1

logs:
	docker compose logs -f

%-sql:
	docker compose exec -it $*-db psql -U user -d app

migrate:
	docker compose down -t 1 -v

test:
	make stop-test
	docker compose -f docker-compose.test.yaml up -t 1 -d --build
	sleep 7
	docker compose -f docker-compose.test.yaml --profile test up -t 1 -d --build
	docker compose -f docker-compose.test.yaml logs -f test

stop-test:
	docker compose -f docker-compose.test.yaml --profile test down -t 1
