FROM node:22 AS build

WORKDIR /app
COPY ["package.json", "package-lock.json", "./"]
RUN ["npm", "ci"]
COPY . .
RUN ["npm", "run", "build"]

FROM nginx:1.25

COPY ./nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/build /var/www/html/
