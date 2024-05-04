package com.ds;

import javax.sql.DataSource;

import org.postgresql.ds.PGSimpleDataSource;

import jakarta.annotation.PostConstruct;
import jakarta.ejb.Singleton;
import jakarta.ejb.Startup;

@Singleton
@Startup
public class AppDataSource {
    private DataSource dataSource;

    @PostConstruct
    public void init() {
        PGSimpleDataSource ds = new PGSimpleDataSource();
        ds.setServerNames(new String[] { System.getenv("DB_HOST") });
        ds.setDatabaseName(System.getenv("DB_NAME"));
        ds.setUser(System.getenv("DB_USER"));
        ds.setPassword(System.getenv("DB_PASSWORD"));
        dataSource = ds;
    }

    public DataSource getInstance() {
        return dataSource;
    }
}
