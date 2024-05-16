package com.ds;

import java.util.Properties;

import javax.sql.DataSource;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import jakarta.annotation.PostConstruct;
import jakarta.ejb.Singleton;
import jakarta.ejb.Startup;

@Singleton
@Startup
public class ApiDataSource {
    private DataSource dataSource;

    @PostConstruct
    public void init() {
        Properties props = new Properties();
        props.setProperty("dataSourceClassName", "org.postgresql.ds.PGSimpleDataSource");
        props.setProperty("dataSource.user", System.getenv("DB_USER"));
        props.setProperty("dataSource.password", System.getenv("DB_PASSWORD"));
        props.setProperty("dataSource.databaseName", System.getenv("DB_NAME"));
        props.setProperty("dataSource.serverName", System.getenv("DB_HOST"));

        HikariConfig config = new HikariConfig(props);
        HikariDataSource ds = new HikariDataSource(config);
        dataSource = ds;
    }

    public DataSource getInstance() {
        return dataSource;
    }
}
