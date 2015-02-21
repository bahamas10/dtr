#!/usr/sbin/dtrace -s

#pragma D option quiet

BEGIN {
	printf("tracing, ctrl-c to exit...\n");
}
syscall::open*:entry
/pid == $target/
{
	printf("[pid %d] %s %s\n", pid, execname, copyinstr(arg0));
}
