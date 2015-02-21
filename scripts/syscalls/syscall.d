#!/usr/sbin/dtrace -s
/**
 * trace syscalls by pid, name, and syscall
 */

BEGIN {
	printf("tracing, ctrl-c to exit...\n");
}
syscall:::entry
{
	@[pid, execname, probefunc] = count();
}
