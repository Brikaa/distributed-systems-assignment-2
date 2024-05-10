package com.ds;

import jakarta.annotation.PostConstruct;
import jakarta.ejb.Singleton;
import jakarta.ejb.Startup;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;

@Singleton
@Startup
public class ApiClient {
    private Client client;

    @PostConstruct
    public void init() {
        client = ClientBuilder.newClient();
    }

    public Client getInstance() {
        return client;
    }
}
