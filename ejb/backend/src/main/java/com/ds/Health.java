package com.ds;

import jakarta.ejb.EJB;
import jakarta.ejb.Stateless;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;

@Path("/health")
@Stateless
public class Health {
    @EJB
    private AppDataSource dataSource;

    @GET
    @Path("/")
    public String health() {
        return "Up and running";
    }
}
