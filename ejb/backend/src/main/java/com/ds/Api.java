package com.ds;

import java.sql.SQLException;

import jakarta.ejb.EJB;
import jakarta.ejb.Stateless;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/")
@Stateless
@Produces(MediaType.APPLICATION_JSON)
public class Api {
    @EJB
    private AppDataSource dataSource;

    @Context
    private HttpServletRequest request;

    @GET
    @Path("/health")
    public Response health() throws SQLException {
        return AuthUtil.withRole(dataSource, request, "admin", (_conn, _rs) -> {
            return Response.status(200).entity(new MessageResponse("Up and running")).build();
        });
    }
}
