package kg.teksherhub.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;

import jakarta.servlet.DispatcherType;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JwtAuthenticationFilterTest {
    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void reauthenticatesBearerTokenDuringAsyncDispatch() throws Exception {
        TokenService tokens = mock(TokenService.class);
        UserDetailsService users = mock(UserDetailsService.class);
        UserDetails user = User.withUsername("ci-admin")
                .password("unused")
                .authorities("ROLE_ADMIN")
                .build();
        when(tokens.username("async-token")).thenReturn("ci-admin");
        when(tokens.isValid("async-token", user)).thenReturn(true);
        when(users.loadUserByUsername("ci-admin")).thenReturn(user);

        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(tokens, users);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setDispatcherType(DispatcherType.ASYNC);
        request.addHeader("Authorization", "Bearer async-token");

        filter.doFilter(request, new MockHttpServletResponse(), (servletRequest, servletResponse) ->
                assertEquals("ci-admin", SecurityContextHolder.getContext().getAuthentication().getName()));

        verify(users).loadUserByUsername("ci-admin");
        verify(tokens).isValid("async-token", user);
    }
}
