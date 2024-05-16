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
	docker compose -p test1 -f docker-compose.test.yaml up -t 1 -d --build
	docker compose -p test2 -f docker-compose.test.yaml up -t 1 -d --build
	sleep 10
	docker compose -p test1 -f docker-compose.test.yaml --profile test1 up -t 1 -d --build
	docker compose -p test2 -f docker-compose.test.yaml --profile test2 up -t 1 -d --build
	docker compose -p test1 -f docker-compose.test.yaml logs -f test1 &
	docker compose -p test2 -f docker-compose.test.yaml logs -f test2 &

stop-test:
	docker compose -p test1 -f docker-compose.test.yaml --profile test1 down -t 1
	docker compose -p test2 -f docker-compose.test.yaml --profile test2 down -t 1
