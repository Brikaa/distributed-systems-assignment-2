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

run-test:
	docker compose -p $(suite_name) -f docker-compose.test.yaml --profile $(suite_name) down -t 1
	docker compose -p $(suite_name) -f docker-compose.test.yaml up -t 1 -d --build
	sleep 10
	docker compose -p $(suite_name) -f docker-compose.test.yaml --profile $(suite_name) up -t 1 -d --build
	docker compose -p $(suite_name) -f docker-compose.test.yaml logs --no-color -f $(suite_name) > test-results/$(suite_name).txt

test:
	make suite_name=test2 run-test &
	make suite_name=test1 run-test &
