package com.ds;

import java.sql.SQLException;
import java.util.UUID;

import jakarta.ejb.EJB;
import jakarta.ejb.Stateless;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

class UserResponse {
    public UUID id;
    public String name;
    public String email;
    public String role;
    public int experience;
    public String bio;

    public UserResponse(UUID id, String name, String email, String role, int experience, String bio) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
        this.experience = experience;
        this.bio = bio;
    }
}

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
            return Response.ok().entity(new MessageResponse("Up and running")).build();
        });
    }

    @GET
    @Path("/user")
    public Response user() throws SQLException {
        return AuthUtil.withRole(dataSource, request, "*", (_conn, rs) -> {
            return Response.ok()
                    .entity(new UserResponse(rs.getObject("id", UUID.class), rs.getString("name"),
                            rs.getString("email"), rs.getString("role"), rs.getInt("experience"), rs.getString("bio")))
                    .build();
        });
    }
}
