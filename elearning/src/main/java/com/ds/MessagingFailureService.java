package com.ds;

import jakarta.annotation.PostConstruct;
import jakarta.ejb.Singleton;
import jakarta.ejb.Startup;

@Singleton
@Startup
public class MessagingFailureService {
    private boolean shouldFakeFailure;
    private boolean failOnNextCall;

    @PostConstruct
    public void init() {
        failOnNextCall = false;
        shouldFakeFailure = System.getenv("FAKE_MDB_FAILURE") != null
                && System.getenv("FAKE_MDB_FAILURE").equalsIgnoreCase("true");
    }

    public boolean getShouldFakeFailure() {
        return shouldFakeFailure;
    }

    public void doFailOnNextCall() {
        failOnNextCall = true;
    }

    public void failIfTesting() {
        if (failOnNextCall) {
            failOnNextCall = false;
            throw new OutOfMemoryError();
        }
    }
}
