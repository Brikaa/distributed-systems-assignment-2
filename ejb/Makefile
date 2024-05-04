start:
	docker compose up -d --build
	make logs

stop:
	docker compose down -t 1

logs:
	docker compose logs -f

sql:
	docker compose exec -it db psql -U user -d app

migrate:
	docker compose down -t 1 -v
